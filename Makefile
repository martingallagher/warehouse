.ONESHELL:
.PHONY: install build test clean

install:
	@npm install

build:
	@npm run build

test:
	@npm test

clean:
	@rm -rf node_modules build cache
