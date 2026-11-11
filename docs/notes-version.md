## AutoBuild — version de test

Maquette sur mesure générée pendant le rendez-vous prospect.

### Télécharger

| Ordinateur | Fichier |
|---|---|
| Windows 10 / 11 | `AutoBuild-Setup-x.y.z.exe` |
| Mac Apple Silicon (M1 à M4…) | `AutoBuild-x.y.z-arm64.dmg` |
| Mac Intel | `AutoBuild-x.y.z-x64.dmg` |

(Menu  → « À propos de ce Mac » : « Puce Apple » = Apple Silicon, « Processeur Intel » = Intel.)

### Installer

L'application n'est pas encore signée par un certificat payant : le système affiche un avertissement la première fois.

- **Windows** : lancer le `.exe` → « Windows a protégé votre ordinateur » → *Informations complémentaires* → *Exécuter quand même*.
- **Mac** : ouvrir le `.dmg`, glisser AutoBuild dans Applications, puis lancer AutoBuild.
  Si macOS refuse (« impossible de vérifier le développeur ») : Réglages Système → Confidentialité et sécurité → en bas,
  *Ouvrir quand même* à côté d'AutoBuild. Si le message dit « endommagé », ouvrir le Terminal et taper :
  `xattr -cr /Applications/AutoBuild.app`

### Essayer, dans l'ordre

1. **La démo, sans rien configurer** : sur l'accueil, carte « Démonstration sans visio » → *Lancer la démo* →
   *Lancer la simulation*. Le faux rendez-vous (entreprise fictive de travaux publics) se rejoue ; le brief, la
   checklist et la maquette se construisent. Cliquez sur *Fenêtre checklist*, puis *Finaliser* et *Ouvrir la maquette*.
2. **Avec Claude** (Réglages → *Accès à Claude*), au choix :
   - **Claude Code installé (votre abonnement)** : installez Claude Code si ce n'est pas fait
     (https://code.claude.com), ouvrez un terminal, tapez `claude`, puis `/login` avec votre compte Claude.
     Dans AutoBuild : Réglages → *Claude Code installé* → *Tester Claude Code* → « Connecté ».
     AutoBuild utilise votre Claude Code tel quel, avec sa propre connexion : il ne lit ni ne stocke aucun identifiant.
   - **Clé API Anthropic** : à créer sur https://console.anthropic.com, à coller dans Réglages → *Clés API*.

   Relancez la démo : la maquette est alors **générée sur mesure par Claude** pendant le faux rendez-vous
   (cochez « Faire remplir le brief par l'IA » et choisissez la vitesse ×1 ou ×2 pour voir aussi le brief rempli par l'IA).
3. **Un vrai rendez-vous** : ajoutez une clé **Gemini** (gratuite sur https://aistudio.google.com, menu *Get API key*) pour
   la transcription. Saisissez le nom et le site d'un prospect → *Préparer la maquette* → cochez l'information RGPD →
   *Démarrer l'écoute*. Utilisez un casque.
   - Mac : autorisez le micro et « Enregistrement de l'écran et de l'audio système » quand macOS le demande, puis relancez l'application.

### À savoir

- Les maquettes sont enregistrées dans `Documents/AutoBuild/maquettes` (projets web modifiables).
- Le mode « Claude Code installé » sert à tester sur votre poste avec votre abonnement. Pour la version commerciale
  distribuée aux agences, Anthropic demande que les produits utilisent des clés API (chaque agence la sienne).
- Ce qu'il faut vérifier pendant vos tests : [docs/tests-terrain.md](https://github.com/pilouleon/AutoBuild-conf/blob/claude/cool-bohr-bfov3o/docs/tests-terrain.md).
