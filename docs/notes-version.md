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

### Nouveautés de la version 0.3

- **Accueil** avec le prochain rendez-vous, la semaine, les choses à faire et les derniers rendez-vous.
- **Rendez-vous préparés à l'avance** (date, lien de la visio, interlocuteurs) : la maquette de départ est prête avant l'appel.
- **Pendant l'appel, l'interface disparaît** : un petit widget reste par-dessus la visio (même en plein écran) et
  n'apparaît pas si vous partagez votre écran. Infos obtenues en vert en haut, infos à obtenir en bas.
- **Historique** : chaque rendez-vous passé garde sa synthèse, son brief, sa transcription, sa maquette et son compte rendu.
- **4 templates** (ERP, application métier, extranet, intranet) avec leur bibliothèque de pages.

### Essayer, dans l'ordre

1. **La démonstration, sans rien configurer** : au premier lancement, *Lancer la démonstration* → choisissez la
   vitesse (×10 ou ×20) → *Lancer la démonstration*. L'interface disparaît, le widget apparaît en haut à droite et se
   remplit au fil du faux rendez-vous (entreprise fictive de travaux publics). Essayez la pastille (bouton –) et le
   retour à l'interface. À la fin, *Terminer* → *Terminer et montrer la maquette* : elle s'ouvre en plein écran
   (Échap pour sortir). Vous arrivez ensuite sur la synthèse du rendez-vous : parcourez Brief, Transcription, Maquette.
2. **Avec Claude** (Réglages → *Accès IA*), au choix :
   - **Claude Code installé (votre abonnement)** : installez Claude Code si ce n'est pas fait
     (https://code.claude.com), ouvrez un terminal, tapez `claude`, puis `/login` avec votre compte Claude.
     Dans AutoBuild : *Claude Code installé* → *Tester la connexion* → « Connecté ».
     AutoBuild utilise votre Claude Code tel quel, avec sa propre connexion : il ne lit ni ne stocke aucun identifiant.
   - **Clé API Anthropic** : à créer sur https://console.anthropic.com, à coller dans *Clé API Anthropic*.

   Relancez une démonstration (*Faire un essai avec un faux rendez-vous* sur l'accueil) : la maquette est alors
   **codée sur mesure par Claude** pendant le faux rendez-vous (vitesse ×1 ou ×5 conseillée, et « Rempli par l'IA »
   pour voir aussi le brief rempli par l'IA).
3. **Un vrai rendez-vous** : ajoutez une clé **Gemini** (gratuite sur https://aistudio.google.com, menu *Get API key*)
   pour la transcription. Testez le son dans Réglages → *Micro et son*. Créez un rendez-vous (*Nouveau rendez-vous*,
   avec le site du prospect), puis *Démarrer le rendez-vous* : vérifiez que les deux niveaux bougent, cochez l'accord du
   prospect, *Lancer l'enregistrement*. Utilisez un casque.
   - Mac : autorisez le micro et « Enregistrement de l'écran et de l'audio système » quand macOS le demande, puis relancez l'application.

### À savoir

- Rendez-vous, briefs et transcriptions sont enregistrés sur votre ordinateur (pas de synchronisation pour l'instant).
- Les maquettes sont enregistrées dans `Documents/AutoBuild/maquettes` (projets web modifiables).
- Le mode « Claude Code installé » sert à tester sur votre poste avec votre abonnement. Pour la version commerciale
  distribuée aux agences, Anthropic demande que les produits utilisent des clés API (chaque agence la sienne).
- Ce qu'il faut vérifier pendant vos tests : [docs/tests-terrain.md](https://github.com/pilouleon/AutoBuild-conf/blob/claude/cool-bohr-bfov3o/docs/tests-terrain.md).
