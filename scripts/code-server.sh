#!/usr/bin/env bash

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

function code() {
	pushd $ROOT

	# Get electron, compile, built-in extensions
	if [[ -z "${VSCODE_SKIP_PRELAUNCH}" ]]; then
		node build/lib/preLaunch.js
	fi

	NODE=$(node build/lib/node.js)
	if [ ! -e $NODE ];then
		# Load remote node
		yarn gulp node
	fi

	popd

	echo "sleeping start"

	sleep 10

	echo "sleeping stop"

	NODE_ENV=development \
	VSCODE_DEV=1 \
	$NODE $ROOT/scripts/code-server.js "$@"
}

code "$@"
