#!/bin/bash
git clone --depth=1 --branch=$2 https://github.com/w3c/$1.git $1-$2
cp -r README.md acknowledgements.html biblio.js terms.html acknowledgements css img script utility $1-$2/common
cd $1-$2
git add -A .
git commit -m "TRAVIS-CI update from aria-common"
git push "https://${GH_TOKEN}@github.com/w3c/$1.git" $2 > /dev/null 2>&1
cd ..
