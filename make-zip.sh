#!/usr/bin/env bash
rm aws-lambda-svg-convert.zip
zip -r aws-lambda-svg-convert.zip . -x *.git* *test**\*
