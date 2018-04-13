#!/bin/bash
git clone --depth=1 --branch=master https://github.com/w3c/$1.git ../../$1
cp -r acknowledgements.html biblio.js terms.html css img script utility ../../$1/common
cd ../../$1
git add -A .
git commit -m "TRAVIS-CI update from aria-common"
echo git push "https://\${GH_TOKEN}@github.com/w3c/$1.git" master \> /dev/null 2\>\&1
