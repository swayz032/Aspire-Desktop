#!/bin/bash
set -e

npx expo export -p web
node scripts/fix-viewport.js
