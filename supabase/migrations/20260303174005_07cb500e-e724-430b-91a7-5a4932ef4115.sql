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