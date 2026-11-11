# Grille de qualification

> Fichier généré depuis `src/shared/brief/schema.ts` (`npm run docs`). Pour modifier la grille, modifiez le code.

26 informations en 6 groupes. Priorité 1 = indispensable (marquée « clé » dans la checklist tant qu'elle manque).
« Maquette » = l'information sert directement à construire la maquette ; sinon, elle sert à la qualification commerciale.

Statuts : **obtenu** (dit clairement), **partiel** (évoqué, incomplet), **manquant** (pas dit : jamais deviné).
Chaque information obtenue ou partielle porte une preuve : citation exacte du transcript, extrait du site web, ou saisie du commercial.

## Entreprise

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Nom de l'entreprise** (`entreprise_nom`) | texte | 1 | oui | Nom commercial de l'entreprise du prospect. | « Pouvez-vous me rappeler le nom exact de votre structure ? » |
| **Secteur d'activité** (`secteur`) | texte | 1 | oui | Métier et secteur de l'entreprise (ex. travaux publics, négoce de matériaux, laboratoire). | « Pouvez-vous me décrire votre activité en quelques mots ? » |
| **Taille / organisation** (`taille`) | texte | 2 |  | Effectif, nombre de sites, chiffre d'affaires, organisation (agences, filiales). | « Combien êtes-vous, et sur combien de sites ? » |
| **Interlocuteur et rôle** (`interlocuteur`) | texte | 2 |  | Nom et fonction de la personne qui parle côté prospect. | « Quel est votre rôle dans le projet ? » |
| **Identité visuelle** (`identite`) | texte | 2 | oui | Couleurs, logo, charte, ton de communication (souvent issus du site web). | « Avez-vous une charte graphique que l’outil devra respecter ? » |

## Projet

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Type de projet** (`type_projet`) | texte | 1 | oui | Nature de l'outil voulu (ERP, CRM, intranet, extranet, application métier, planning, mobile terrain...). | « Si vous deviez résumer l’outil idéal en une phrase, ce serait quoi ? » |
| **Contexte et déclencheur** (`contexte`) | texte | 1 |  | Pourquoi maintenant : problème vécu, événement déclencheur, douleur actuelle. | « Qu’est-ce qui vous pousse à lancer ce projet maintenant ? » |
| **Objectifs** (`objectifs`) | liste | 1 | oui | Résultats attendus (gagner du temps, fiabiliser, suivre en temps réel...). | « Comment saurez-vous dans un an que le projet est réussi ? » |
| **Outils existants** (`existant`) | liste | 2 |  | Outils utilisés aujourd’hui (Excel, logiciel du marché, papier...) et leurs limites. | « Comment gérez-vous ça aujourd’hui, avec quels outils ? » |
| **Périmètre / modules** (`modules`) | liste | 1 | oui | Grands blocs fonctionnels souhaités (ex. devis, planning, stocks, facturation, espace client). | « Quels sont les grands blocs que l’outil doit couvrir ? » |

## Utilisateurs

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Rôles utilisateurs** (`roles`) | liste | 1 | oui | Profils qui utiliseront l’outil et ce qu’ils y font (attributs = actions principales). | « Qui va utiliser l’outil au quotidien, et pour faire quoi ? » |
| **Nombre d'utilisateurs** (`volume_utilisateurs`) | texte | 2 |  | Nombre d’utilisateurs par profil, internes et externes. | « Combien de personnes l’utiliseront ? » |
| **Contexte d’utilisation** (`acces`) | texte | 2 | oui | Bureau, terrain, mobile, tablette, accès externe (clients, partenaires). | « L’outil sera utilisé au bureau, sur le terrain, sur mobile ? » |

## Fonctionnel

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Objets métier** (`entites`) | liste | 1 | oui | Objets manipulés (chantier, commande, dossier...) avec leurs informations clés (attributs = champs cités). | « Quelles informations suivez-vous pour chaque dossier, chantier ou commande ? » |
| **Processus clés** (`processus`) | liste | 1 | oui | Enchaînements et étapes de travail (du devis à la facture, validation en 3 étapes...). | « Pouvez-vous me dérouler le parcours type, du début à la fin ? » |
| **Écrans prioritaires** (`ecrans_prioritaires`) | liste | 2 | oui | Vues ou écrans explicitement demandés (planning, carte, tableau de bord, fiche client...). | « S’il ne devait y avoir qu’un écran, lequel serait-ce ? » |
| **Indicateurs / reporting** (`indicateurs`) | liste | 2 | oui | Indicateurs suivis, tableaux de bord, exports attendus. | « Quels chiffres regardez-vous en premier chaque semaine ? » |

## Technique

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Intégrations** (`integrations`) | liste | 2 |  | Logiciels à connecter (comptabilité, ERP, paie, CRM, signature, API...). | « Avec quels logiciels l’outil devra-t-il échanger des données ? » |
| **Reprise de données** (`reprise_donnees`) | texte | 3 |  | Données existantes à importer, volumes. | « Faudra-t-il reprendre des données existantes ? » |
| **Contraintes** (`contraintes`) | liste | 2 |  | Hébergement, sécurité, RGPD, SSO, hors ligne, accessibilité, performance. | « Avez-vous des contraintes d’hébergement, de sécurité ou de connexion ? » |

## Commercial

| Information | Type | Priorité | Maquette | Ce qu'on cherche | Question suggérée |
|---|---|---|---|---|---|
| **Budget** (`budget`) | texte | 1 |  | Enveloppe budgétaire, fourchette, mode de financement. | « Avez-vous une enveloppe budgétaire en tête pour ce projet ? » |
| **Délai / échéances** (`delai`) | texte | 1 |  | Date de mise en service souhaitée, jalons, contraintes de calendrier. | « Pour quand auriez-vous besoin d’une première version ? » |
| **Décideurs et processus de décision** (`decideurs`) | texte | 1 |  | Qui décide, qui valide, comment se fait le choix (comité, appel d’offres). | « Qui d’autre participera à la décision, et comment allez-vous choisir ? » |
| **Autres prestataires consultés** (`concurrence`) | texte | 2 |  | Autres agences, éditeurs ou solutions étudiées. | « Consultez-vous d’autres prestataires ou des logiciels du marché ? » |
| **Critères de choix** (`criteres`) | liste | 2 |  | Ce qui fera choisir un prestataire (prix, proximité, références, méthode...). | « Sur quels critères allez-vous choisir votre prestataire ? » |
| **Prochaine étape** (`prochaine_etape`) | texte | 2 |  | Suite convenue (R2, envoi de proposition, démo, visite). | « On cale ensemble la prochaine étape ? » |
