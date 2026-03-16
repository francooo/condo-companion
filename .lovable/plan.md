

## Problema

Quando um morador faz login via Google OAuth, ele não informa o identificador do condomínio. O trigger `handle_new_user` cria o perfil sem `condo_id`, e o usuário fica "órfão" — sem acesso a nenhum condomínio.

## Solução: Página de Vinculação de Condomínio

Criar uma página intermediária `/select-condo` que aparece quando o usuário autenticado tem `profile.condo_id = null` e `role = 'resident'`. Nessa página, o morador informa o identificador (slug) do condomínio para vincular-se.

### Fluxo

```text
Google OAuth → callback → AuthContext carrega profile
  → profile.condo_id == null?
    → SIM → redireciona para /select-condo
    → NÃO → redireciona normalmente (/chat, /admin, /superadmin)
```

### Alterações

1. **Nova página `src/pages/SelectCondoPage.tsx`**
   - Input para o slug do condomínio
   - Busca o `condos.id` pelo slug informado
   - Atualiza `profiles.condo_id` do usuário autenticado
   - Chama `refreshProfile()` e redireciona para `/chat`

2. **`src/App.tsx`**
   - Adicionar rota `/select-condo` (protegida, requer autenticação)

3. **`src/pages/Index.tsx`** e **`src/pages/LoginPage.tsx`**
   - Nos `useEffect` de redirecionamento, adicionar checagem: se `profile.condo_id == null && role !== 'superadmin'`, redirecionar para `/select-condo`

4. **`src/pages/LoginPage.tsx`**
   - No fluxo de login com Google, passar o `condoSlug` como query param no `redirectTo` para que, ao retornar, a página `/select-condo` possa pré-preencher o campo (se o usuário preencheu antes de clicar no botão Google)

5. **RLS — migração SQL**
   - Adicionar policy em `profiles` permitindo que o próprio usuário faça `UPDATE` do seu `condo_id` quando ele for `NULL` (para a vinculação inicial):
   ```sql
   CREATE POLICY "users_set_own_condo"
   ON public.profiles FOR UPDATE
   TO authenticated
   USING (id = auth.uid() AND condo_id IS NULL)
   WITH CHECK (id = auth.uid());
   ```

### Detalhes Técnicos

- A `SelectCondoPage` usará `supabase.from('condos').select('id, name').eq('identifier', slug).maybeSingle()` para validar o condomínio
- Após validação, fará `supabase.from('profiles').update({ condo_id: condo.id }).eq('id', user.id)`
- A policy RLS restritiva garante que o usuário só pode definir seu próprio `condo_id` quando ainda está `NULL`, impedindo troca posterior
- Superadmins são excluídos desta lógica pois não precisam de `condo_id`

