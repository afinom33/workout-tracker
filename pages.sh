#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ -d .pages ]; then
  git worktree remove .pages --force || rm -rf .pages
fi
git worktree add .pages gh-pages
cp dist/index.html .pages/index.html
cd .pages
git add -A
git commit -m "Deploy weekly workout plans"
git push origin gh-pages
cd ..
git worktree remove .pages --force
echo "=== PAGES HEAD"
git ls-remote origin gh-pages
