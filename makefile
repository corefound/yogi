# variable
.PHONY: compile ts-build build run


build:
	@rm -rf ./build
	@cmake -G Ninja -B build && cmake --build build
	@echo
	@echo Build complete

run:
	@./build/yogi ./tests/main.io

# Flatbuffers
fbs-build:
	@cd $(CURDIR)/src/fbs && flatc --cpp --ts ./schemas/main.fbs
	@cd $(CURDIR)/src/compiler/src/fbs && rm -rf yogi
	@mv $(CURDIR)/src/fbs/yogi $(CURDIR)/src/compiler/src/fbs/yogi

# TypeScript
ts-dev:
	@cd $(CURDIR)/src/compiler && npm run dev

ts-run:
	$(CURDIR)/src/compiler/bin/ts-parser-macos-arm64 $(CURDIR)/tests/main.io

ts-build:
	@cd $(CURDIR)/tools/typescript && rm -rf built && npm run build
	@cd $(CURDIR)/src/compiler/src/ts && rm -rf local
	@mv $(CURDIR)/tools/typescript/built/local $(CURDIR)/src/compiler/src/ts/local

ts-pkg:
	@cd $(CURDIR)/src/compiler && npm run pkg