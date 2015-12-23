FILES=$1
FILES=${FILES:-tests/*/**/*.js}
echo "Running test files: $FILES"
tape tests/test-helper.js $FILES | faucet
