// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include <cstring>
#include <sys/wait.h>
#include <unistd.h>

namespace {
	void runCase(const char *name) {
		void *value = yogi_alloc(8);
		yogi_free(value);

		if (std::strcmp(name, "double-free") == 0) {
			yogi_free(value);
			return;
		}

		if (std::strcmp(name, "invalid-free") == 0) {
			int stackValue = 7;
			yogi_free(&stackValue);
			return;
		}

		if (std::strcmp(name, "double-destroy") == 0) {
			void *array = yogi_array_create(1);
			yogi_array_destroy(array);
			yogi_array_destroy(array);
			return;
		}

		if (std::strcmp(name, "use-after-destroy") == 0) {
			void *array = yogi_array_create(1);
			yogi_array_destroy(array);
			(void) yogi_array_get(array, 0);
			return;
		}
	}

	bool expectAbort(const char *name) {
		const auto child = fork();

		if (child == 0) {
			runCase(name);
			_exit(0);
		}

		if (child < 0) {
			return false;
		}

		int status = 0;
		if (waitpid(child, &status, 0) < 0) {
			return false;
		}

		return WIFSIGNALED(status) || (WIFEXITED(status) && WEXITSTATUS(status) != 0);
	}
}

int main() {
	yogi_debug_ownership_reset();

	if (!expectAbort("double-free")) {
		return 1;
	}

	if (!expectAbort("invalid-free")) {
		return 1;
	}

	if (!expectAbort("double-destroy")) {
		return 1;
	}

	if (!expectAbort("use-after-destroy")) {
		return 1;
	}

	yogi_debug_ownership_reset();
	(void) yogi_array_create(1);
	return yogi_debug_ownership_report_leaks() == 0 ? 1 : 0;
}
