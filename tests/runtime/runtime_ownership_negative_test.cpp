// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include <sys/wait.h>
#include <unistd.h>
#include <cstdio>
#include <cstring>
#include <string>

namespace {
    void runCase(const char* name) {
        yogi_memory_push_context("ownership-negative", name);
        yogi_memory_push_source_location("tests/runtime/ownership_negative.io", 7, 3);

        void* value = yogi_alloc(8);
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
            void* array = yogi_array_create(1);
            yogi_array_destroy(array);
            yogi_array_destroy(array);
            return;
        }

        if (std::strcmp(name, "use-after-destroy") == 0) {
            void* array = yogi_array_create(1);
            yogi_array_destroy(array);
            (void)yogi_array_get(array, 0);
            return;
        }

        yogi_memory_pop_source_location();
        yogi_memory_pop_context();
    }

    bool expectAbort(const char* name, const char* expectedText) {
        int pipes[2];
        if (pipe(pipes) != 0) {
            return false;
        }

        const auto child = fork();

        if (child == 0) {
            close(pipes[0]);
            dup2(pipes[1], STDERR_FILENO);
            close(pipes[1]);
            runCase(name);
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
        const bool matched = aborted && error.find(expectedText) != std::string::npos && error.find("created: module=ownership-negative") != std::string::npos && error.find("last-event: module=ownership-negative") != std::string::npos &&
            error.find("detected: module=ownership-negative") != std::string::npos && error.find("source=tests/runtime/ownership_negative.io:7:3") != std::string::npos;

        if (!matched) {
            std::fprintf(stderr, "ownership negative case '%s' failed. Captured stderr:\n%s\n", name, error.c_str());
        }

        return matched;
    }
} // namespace

int main() {
    yogi_debug_ownership_reset();

    if (!expectAbort("double-free", "double free")) {
        return 1;
    }

    if (!expectAbort("invalid-free", "invalid free")) {
        return 1;
    }

    if (!expectAbort("double-destroy", "array destroy/drop after destroy/drop")) {
        return 1;
    }

    if (!expectAbort("use-after-destroy", "array get")) {
        return 1;
    }

    yogi_debug_ownership_reset();
    yogi_memory_push_context("ownership-negative", "leak-report");
    yogi_memory_push_source_location("tests/runtime/ownership_negative.io", 41, 2);
    (void)yogi_array_create(1);
    yogi_memory_pop_source_location();
    yogi_memory_pop_context();
    return yogi_debug_ownership_report_leaks() == 0 ? 1 : 0;
}
