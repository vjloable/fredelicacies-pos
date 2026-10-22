#!/bin/sh
# Bump the version, tag it, and push to main.
# Usage: npm run release <patch|minor|major|x.y.z>
set -e

if [ -z "$1" ]; then
	echo "Usage: npm run release <patch|minor|major|x.y.z>" >&2
	exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
	echo "Releases must be cut from main (currently on $branch)." >&2
	exit 1
fi

npm version "$1"
git push origin main --follow-tags
