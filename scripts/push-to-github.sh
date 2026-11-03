#!/usr/bin/env bash
# Envoie le projet DIGINIGER sur GitHub.
#
# Utilisation :
#   GITHUB_TOKEN=ghp_xxx ./scripts/push-to-github.sh
#   ./scripts/push-to-github.sh mon-nom-de-depot        (si gh est déjà connecté)
#
# Le jeton a besoin du droit "repo" (Settings > Developer settings >
# Personal access tokens). Il n'est jamais écrit dans un fichier.

set -euo pipefail
cd "$(dirname "$0")/.."

REPO_NAME="${1:-diginiger}"
BRANCH="main"

echo "== DIGINIGER : envoi vers GitHub =="
echo "Dépôt visé : $REPO_NAME (branche $BRANCH)"
echo

# --- Cas 1 : la commande gh est installée et connectée -----------------------
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  OWNER="$(gh api user --jq .login)"
  echo "GitHub CLI détectée, compte : $OWNER"
  gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
  echo
  echo "✔ Terminé : https://github.com/$OWNER/$REPO_NAME"
  exit 0
fi

# --- Cas 2 : envoi direct avec un jeton -------------------------------------
if [ -z "${GITHUB_TOKEN:-}" ]; then
  cat <<'EOF'
Aucun compte GitHub connecté et aucun jeton fourni.

Deux solutions :
  A) installer et connecter la commande gh :
       gh auth login
       ./scripts/push-to-github.sh
  B) créer un jeton sur https://github.com/settings/tokens (droit "repo")
     puis :
       GITHUB_TOKEN=ghp_votre_jeton ./scripts/push-to-github.sh
EOF
  exit 1
fi

API="https://api.github.com"
AUTH="Authorization: Bearer $GITHUB_TOKEN"
OWNER="$(curl -fsS -H "$AUTH" -H "Accept: application/vnd.github+json" "$API/user" \
  | sed -n 's/.*"login"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$OWNER" ] || { echo "✘ Jeton refusé par GitHub. Vérifiez qu'il est valide et a le droit 'repo'."; exit 1; }
echo "Compte GitHub : $OWNER"

# Création du dépôt (silencieux si déjà existant)
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "$AUTH" -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"description\":\"DIGINIGER - plateforme e-learning\"}" \
  "$API/user/repos")"

case "$HTTP" in
  201) echo "Dépôt créé : $OWNER/$REPO_NAME" ;;
  422) echo "Dépôt déjà existant : $OWNER/$REPO_NAME" ;;
  *)   echo "✘ Création impossible (HTTP $HTTP)."; exit 1 ;;
esac

# Envoi du code
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
git push "https://x-access-token:$GITHUB_TOKEN@github.com/$OWNER/$REPO_NAME.git" "$BRANCH:$BRANCH" --force

# Le jeton vient de la ligne de commande uniquement : on ne le stocke pas
git remote set-url origin "https://github.com/$OWNER/$REPO_NAME.git"

echo
echo "✔ Code envoyé : https://github.com/$OWNER/$REPO_NAME"
echo
echo "Étape suivante : Vercel > projet diginiger > Settings > Git > connecter ce dépôt."
