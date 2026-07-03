import { useState } from 'react';
import { Button, Menu, MenuItem, ListItemText, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { devLogin, getCurrentUser } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';

// Usernames MUST match those seeded by DataSeeder exactly — case-sensitive.
const DEV_USERS = [
  { username: 'admin',    label: 'Admin (ADMIN)' },
  { username: 'Sophie_M', label: 'Sophie (VERIFIED)' },
  { username: 'Thomas_R', label: 'Thomas (VERIFIED)' },
  { username: 'Lea_F',    label: 'Lea (unverified newcomer)' },
] as const;

export default function DevLoginButton() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const { loginFromUser } = useAuthStore();
  const queryClient = useQueryClient();

  const handleLogin = async (username: string) => {
    setAnchorEl(null);
    setLoading(true);
    try {
      const res = await devLogin(username);
      // Cookie is set by the backend — now fetch the full user
      const user = await getCurrentUser();
      // Drop any cached query from the previous user (especially ['me']) before
      // setting the new identity, otherwise the Profile page would briefly render
      // the previous user before the fresh refetch lands.
      queryClient.clear();
      loginFromUser(user);
      // Update admin/verified from the dev login response
      useAuthStore.setState({
        isAdmin: res.role === 'ADMIN',
        isVerified: res.verified === 'true',
      });
    } catch (e) {
      console.error('Dev login failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={loading}
      >
        {loading ? '...' : 'Dev Login'}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">Choisir un compte :</Typography>
        </MenuItem>
        {DEV_USERS.map((u) => (
          <MenuItem key={u.username} onClick={() => handleLogin(u.username)}>
            <ListItemText primary={u.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
