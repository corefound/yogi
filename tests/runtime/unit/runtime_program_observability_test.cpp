// Created by Brayhan De Aza on 7/26/26.
//

#include "yogi/runtime.h"
#include "yogi/runtime/observability/programObservability.h"

#include <cassert>
#include <cstdlib>

int main() {
    assert(yogi_program_observability_enabled());

    yogi_memory_push_context("runtime-observability-test", "allocation-lifetime");
    yogi_memory_push_source_location("runtime-observability-test.ts", 4, 2);

    auto* allocation = yogi_alloc(16);
    allocation = yogi_realloc(allocation, 64);
    yogi_free(allocation);

    auto* resource = std::malloc(8);
    assert(resource != nullptr);
    yogi_observe_resource_create(resource, "test native resource");
    yogi_observe_resource_destroy(resource, "test native resource");
    std::free(resource);

    yogi::runtime::ProgramObservability::
        recordCleanupEvent("lowering", "cleanup.schedule", "cleanup:runtime-test:1", "value", "string", "yogi_string_destroy", "heap", "none", 1, "runtime-observability-test", "allocation-lifetime", "runtime-observability-test.ts", 4, 2);
    yogi::runtime::ProgramObservability::
        recordCleanupEvent("lowering", "cleanup.emit", "cleanup:runtime-test:1", "value", "string", "yogi_string_destroy", "heap", "normal", 1, "runtime-observability-test", "allocation-lifetime", "runtime-observability-test.ts", 4, 2);
    yogi_observe_cleanup("cleanup:runtime-test:1", "value", "string", "yogi_string_destroy", "heap", "cleanup.activate", "none", "runtime-observability-test.ts", 4, 2);
    yogi_observe_cleanup("cleanup:runtime-test:1", "value", "string", "yogi_string_destroy", "heap", "cleanup.execute", "normal", "runtime-observability-test.ts", 4, 2);

    yogi_memory_pop_source_location();
    yogi_memory_pop_context();
    return 0;
}
