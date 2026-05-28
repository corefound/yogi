#include <iostream>
#include <string>
#include <json.hpp>
#include "includes/core.h"

int main() {
    const nlohmann::json ast = yogi::core::Core::TSParser();
    std::cout << ast.dump(1) << std::endl;

}