import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconButton, Drawer, List, ListItemButton, ListItemText, ListItemIcon, Box, Divider, Badge as MuiBadge } from '@mui/material';
import { Menu as MenuIcon, Close, DarkMode, LightMode, Notifications } from '@mui/icons-material';
import DiscordIcon from '@/components/icons/DiscordIcon';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuthPromptStore } from '@/stores/useAuthPromptStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useMarkAllNotificationsRead, useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { NAV_LINKS } from './Navbar.data';
import { DISCORD_INVITE_URL } from '@/lib/constants';
import DevLoginButton from '@/components/common/DevLoginButton';
import { useLogout } from '@/hooks/useLogout';
import * as s from './MobileMenu.styles';

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { token, user, isAdmin } = useAuthStore();
  const logout = useLogout();
  const promptLogin = useAuthPromptStore((s) => s.show);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const unread = useUnreadNotificationsCount();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <>
      <IconButton onClick={() => setOpen(true)} color="inherit">
        <MenuIcon />
      </IconButton>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: s.drawerPaper } }}
      >
        <Box sx={s.drawerBox}>
          <Box sx={s.closeRow}>
            <IconButton onClick={() => setOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          <List>
            {NAV_LINKS.map((link) => {
              const gated = link.protected && !token;
              return (
                <ListItemButton
                  key={link.key}
                  component={Link}
                  to={link.to}
                  onClick={(e) => {
                    if (gated) {
                      e.preventDefault();
                      promptLogin();
                    }
                    setOpen(false);
                  }}
                  aria-disabled={gated || undefined}
                >
                  <ListItemText primary={t(`nav.${link.key}`)} />
                </ListItemButton>
              );
            })}
            {token && (
              <ListItemButton onClick={() => { if (unread > 0) markAllRead.mutate(); setOpen(false); }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <MuiBadge badgeContent={unread} color="error" max={9}>
                    <Notifications fontSize="small" />
                  </MuiBadge>
                </ListItemIcon>
                <ListItemText primary={t('notifications.title')} />
              </ListItemButton>
            )}
            {token ? (
              <>
                <ListItemButton component={Link} to="/profile" onClick={() => setOpen(false)}>
                  <ListItemText primary={t('nav.profile')} />
                </ListItemButton>
                <ListItemButton component={Link} to="/upload" onClick={() => setOpen(false)}>
                  <ListItemText primary={t('nav.upload')} />
                </ListItemButton>
                {(isAdmin || user?.moderator || user?.editor) && (
                  <ListItemButton
                    component={Link}
                    to="/admin"
                    onClick={() => setOpen(false)}
                    sx={{ color: 'warning.main', '& .MuiListItemText-primary': { fontWeight: 600 } }}
                  >
                    <ListItemText primary={t('nav.admin')} />
                  </ListItemButton>
                )}
                <ListItemButton
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                >
                  <ListItemText primary={t('nav.logout')} />
                </ListItemButton>
              </>
            ) : import.meta.env.DEV ? (
              <Box sx={{ px: 2, py: 1 }}>
                <DevLoginButton />
              </Box>
            ) : (
              <ListItemButton component="a" href="/oauth2/authorization/discord">
                <ListItemText primary={t('nav.login')} />
              </ListItemButton>
            )}
            <Divider sx={{ my: 1 }} />
            <ListItemButton onClick={toggleTheme}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {theme === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </ListItemIcon>
              <ListItemText primary={t(theme === 'dark' ? 'nav.lightMode' : 'nav.darkMode')} />
            </ListItemButton>
            {/* startsWith : un navigateur fr-BE/fr-FR doit surligner « Français » (langue résolue ≠ code exact) */}
            <ListItemButton onClick={() => i18n.changeLanguage('fr')} selected={i18n.language.startsWith('fr')}>
              <ListItemText primary="Français" />
            </ListItemButton>
            <ListItemButton onClick={() => i18n.changeLanguage('en')} selected={i18n.language.startsWith('en')}>
              <ListItemText primary="English" />
            </ListItemButton>
            <Divider sx={{ my: 1 }} />
            <ListItemButton
              component="a"
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DiscordIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Discord ISFCE" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
