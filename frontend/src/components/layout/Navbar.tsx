import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, IconButton, Box, Menu, MenuItem, Tooltip, useMediaQuery } from '@mui/material';
import { DarkMode, LightMode, Search } from '@mui/icons-material';
import DiscordIcon from '@/components/icons/DiscordIcon';
import FreenoteMark from '@/components/icons/FreenoteMark';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuthPromptStore } from '@/stores/useAuthPromptStore';
import { useCommandPaletteStore } from '@/stores/useCommandPaletteStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { DISCORD_OAUTH_URL, DISCORD_INVITE_URL } from '@/lib/constants';
import DevLoginButton from '@/components/common/DevLoginButton';
import UserAvatar from '@/components/common/UserAvatar';
import { useLogout } from '@/hooks/useLogout';
import NotificationBell from './NotificationBell';
import MobileMenu from './MobileMenu';
import { NAV_LINKS } from './Navbar.data';
import * as s from './Navbar.styles';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, token, isAdmin } = useAuthStore();
  const logout = useLogout();
  const promptLogin = useAuthPromptStore((s) => s.show);
  const openSearch = useCommandPaletteStore((s) => s.show);
  const { theme, toggle } = useThemeStore();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <AppBar position="sticky" component="nav" aria-label="Main navigation" sx={s.appBar}>
      <Toolbar sx={s.toolbar}>
        <Box component={Link} to="/" sx={s.logo} aria-label="Freenote, accueil">
          <FreenoteMark size={28} />
          <Typography variant="h6" component="span" sx={{ fontWeight: 800, lineHeight: 1 }}>
            Free<Box component="span" sx={s.logoGradient}>note</Box>
          </Typography>
        </Box>

        {isMobile ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={openSearch} color="inherit" aria-label={t('globalSearch.title')}>
              <Search />
            </IconButton>
            <MobileMenu />
          </Box>
        ) : (
          <Box sx={s.actionsRow}>
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              const gated = link.protected && !token;
              return (
                <Button
                  key={link.key}
                  component={Link}
                  to={link.to}
                  onClick={(e) => {
                    if (gated) {
                      e.preventDefault();
                      promptLogin();
                    }
                  }}
                  color="inherit"
                  size="small"
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={gated || undefined}
                  sx={s.navButton(active)}
                >
                  {t(`nav.${link.key}`)}
                </Button>
              );
            })}

            <Tooltip title={`${t('globalSearch.title')} (Ctrl+K)`}>
              <IconButton onClick={openSearch} size="small" color="inherit" aria-label={t('globalSearch.title')}>
                <Search fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('nav.toggleTheme')}>
              <IconButton onClick={toggle} size="small" color="inherit" aria-label={t('nav.toggleTheme')}>
                {theme === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* startsWith : un navigateur fr-BE/fr-FR garde i18n.language = « fr-BE » (seul
                resolvedLanguage est normalisé) — la comparaison stricte laissait FR non surligné. */}
            <Box sx={s.langToggle}>
              <Box
                component="button"
                onClick={() => i18n.changeLanguage('fr')}
                sx={s.langOption(i18n.language.startsWith('fr'))}
              >
                FR
              </Box>
              <Box
                component="button"
                onClick={() => i18n.changeLanguage('en')}
                sx={s.langOption(i18n.language.startsWith('en'))}
              >
                EN
              </Box>
            </Box>

            {token && <NotificationBell />}

            <Tooltip title="Discord ISFCE">
              <IconButton
                component="a"
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                color="inherit"
                aria-label="Discord ISFCE"
              >
                <DiscordIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {token ? (
              <>
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  size="small"
                  aria-label={t('nav.profile')}
                  aria-expanded={Boolean(anchorEl)}
                  aria-haspopup="menu"
                >
                  <UserAvatar username={user?.username ?? '?'} url={user?.avatarUrl} size={40} />
                </IconButton>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      navigate('/profile');
                    }}
                  >
                    {t('nav.profile')}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      navigate('/upload');
                    }}
                  >
                    {t('nav.upload')}
                  </MenuItem>
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null);
                        navigate('/admin');
                      }}
                      sx={{ color: 'warning.main', fontWeight: 600 }}
                    >
                      {t('nav.admin')}
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      logout();
                    }}
                  >
                    {t('nav.logout')}
                  </MenuItem>
                </Menu>
              </>
            ) : import.meta.env.DEV ? (
              <DevLoginButton />
            ) : (
              <Button variant="contained" size="small" href={DISCORD_OAUTH_URL}>
                {t('nav.login')}
              </Button>
            )}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
