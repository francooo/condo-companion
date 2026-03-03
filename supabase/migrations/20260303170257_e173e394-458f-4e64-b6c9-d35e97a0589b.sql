
-- Create trigger for auto-creating profiles on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set superadmin for andrewsfranco93@gmail.com
UPDATE public.profiles
SET role = 'superadmin', full_name = 'andrews'
WHERE id = (SELECT id FROM auth.users WHERE email = 'andrewsfranco93@gmail.com');
