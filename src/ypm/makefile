
.PHONY: all build init longin

build:
	@cmake -G Ninja -B build && cmake --build build

publish:
	@cd $(CURDIR)/tests && ../build/yogi publish

longin:
	@$(CURDIR)/build/yogi longin