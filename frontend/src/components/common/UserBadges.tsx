import { Chip } from '@mui/material';
import { School, HowToVote } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface UserBadgesProps {
  /** Diplômé + année de fin → badge « Promo {year} ». */
  graduated?: boolean;
  studyEndYear?: number | null;
  /** Mandat de délégué EN COURS. */
  delegate?: boolean;
  /** A DÉJÀ été délégué mais plus en fonction → « Ancien délégué ». */
  formerDelegate?: boolean;
  /** Rendu plus compact (lignes denses : classement). */
  dense?: boolean;
}

/**
 * Badges communautaires d'un utilisateur (Promo diplômé, Délégué, Ancien délégué), rendus comme une
 * suite de <Chip> à placer dans le conteneur flex de l'appelant. Source unique de vérité pour ces
 * badges partout où un user apparaît (profil, carte uploader, classement).
 */
export default function UserBadges({
  graduated,
  studyEndYear,
  delegate,
  formerDelegate,
  dense,
}: UserBadgesProps) {
  const { t } = useTranslation();
  const showPromo = !!graduated && !!studyEndYear;
  if (!showPromo && !delegate && !formerDelegate) return null;

  const chipSx = { fontSize: dense ? 10 : 11, height: dense ? 20 : 22 } as const;

  return (
    <>
      {showPromo && (
        <Chip
          icon={<School sx={{ fontSize: 13 }} />}
          label={t('profile.journey.promoBadge', { year: studyEndYear })}
          size="small"
          color="secondary"
          variant="outlined"
          sx={chipSx}
        />
      )}
      {delegate && (
        <Chip
          icon={<HowToVote sx={{ fontSize: 13 }} />}
          label={t('badges.delegate')}
          size="small"
          color="primary"
          variant="outlined"
          sx={chipSx}
        />
      )}
      {formerDelegate && (
        <Chip
          icon={<HowToVote sx={{ fontSize: 13 }} />}
          label={t('badges.formerDelegate')}
          size="small"
          variant="outlined"
          sx={{ ...chipSx, opacity: 0.72 }}
        />
      )}
    </>
  );
}
