

## Problem Analysis

The `handleSignup` function (lines 100-135) validates the condo slug and finds the condo ID, but **never associates it with the new user**. The `supabase.auth.signUp` call only passes `full_name` in metadata. The `handle_new_user` trigger only sets `id` and `full_name` on the profile — it doesn't set `condo_id`.

## Solution

Two changes are needed:

### 1. Update `handle_new_user()` trigger function (SQL migration)
Modify the trigger to read a `condo_identifier` field from `raw_user_meta_data`, look up the condo, and set `condo_id` on the profile automatically.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _condo_id uuid;
  _identifier text;
BEGIN
  _identifier := NEW.raw_user_meta_data->>'condo_identifier';
  IF _identifier IS NOT NULL AND _identifier != '' THEN
    SELECT id INTO _condo_id FROM public.condos WHERE identifier = _identifier;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, condo_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _condo_id);
  RETURN NEW;
END;
$$;
```

### 2. Update `handleSignup` in `LoginPage.tsx`
Pass `condo_identifier` in the signup metadata so the trigger can pick it up:

```typescript
const { error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    data: { full_name: fullName, condo_identifier: condoSlug.trim().toLowerCase() },
    emailRedirectTo: window.location.origin,
  },
});
```

### 3. Fix existing user
Use the insert/update tool to set the `condo_id` for the user `andrews.franco@afecomm.com.br` who was already created without it.

---

### Technical Detail
- The trigger approach is clean because it runs server-side with SECURITY DEFINER privileges, so the profile gets the correct `condo_id` atomically at creation time.
- No RLS changes are needed since the trigger already bypasses RLS via SECURITY DEFINER.

