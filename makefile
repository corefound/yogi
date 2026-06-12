# variable
.PHONY: run build start fbs-build ts-dev ts-run ts-build ts-pkg


run: build start


build:
	@rm -rf ./build
	@cmake -G Ninja -B build && cmake --build build
	@echo
	@echo Build complete

start:
	@./build/yogi ./tests/main.io

# Flatbuffers
fbs-build:
	@cd $(CURDIR)/src/fbs && flatc --cpp --ts --gen-all -o ./generated ./schemas/main.fbs
	@cd $(CURDIR)/src/compiler/src/fbs && rm -rf generated && mkdir generated
	@mv $(CURDIR)/src/fbs/generated/yogi $(CURDIR)/src/compiler/src/fbs/generated/yogi
	@mv -f $(CURDIR)/src/fbs/generated/main_generated.h  $(CURDIR)/libs/flatbuffers/fbs_generated.h
	@cd $(CURDIR)/src/fbs && rm -rf generated


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