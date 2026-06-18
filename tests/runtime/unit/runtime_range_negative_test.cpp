// Created by Brayhan De Aza on 6/18/26.
//

#include "yogi/runtime.h"

#include <sys/wait.h>
#include <unistd.h>
#include <cstdio>
#include <string>

namespace {
	bool expectAbort(const char *expectedText) {
		int pipes[2];
		if (pipe(pipes) != 0) {
			return false;
		}

		const auto child = fork();

		if (child == 0) {
			close(pipes[0]);
			dup2(pipes[1], STDERR_FILENO);
			close(pipes[1]);

			yogi_memory_push_context("range-negative", "array-with");
			yogi_memory_push_source_location("tests/runtime/range_negative.ts", 9, 5);
			void *array = yogi_array_create(2);
			(void)yogi_array_with(array, 2, yogi_any_from_number(10));
			_exit(0);
		}

		if (child < 0) {
			close(pipes[0]);
			close(pipes[1]);
			return false;
		}

		close(pipes[1]);
		std::string error;
		char buffer[512];
		ssize_t bytesRead = 0;

		while ((bytesRead = read(pipes[0], buffer, sizeof(buffer))) > 0) {
			error.append(buffer, static_cast<std::size_t>(bytesRead));
		}

		close(pipes[0]);

		int status = 0;
		if (waitpid(child, &status, 0) < 0) {
			return false;
		}

		const bool aborted = WIFSIGNALED(status) || (WIFEXITED(status) && WEXITSTATUS(status) != 0);
		const bool matched = aborted &&
			error.find(expectedText) != std::string::npos &&
			error.find("array.with") != std::string::npos &&
			error.find("detected: module=range-negative") != std::string::npos &&
			error.find("source=tests/runtime/range_negative.ts:9:5") != std::string::npos;

		if (!matched) {
			std::fprintf(stderr, "range negative case failed. Captured stderr:\n%s\n", error.c_str());
		}

		return matched;
	}
} // namespace

int main() {
	yogi_debug_ownership_reset();
	return expectAbort("yogi runtime range error") ? 0 : 1;
}
