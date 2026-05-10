-- Function to confirm user email by user ID
CREATE OR REPLACE FUNCTION confirm_user_email(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = p_user_id AND email_confirmed_at IS NULL;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;