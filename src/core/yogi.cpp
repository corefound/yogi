#include <iostream>
#include <string>
#include <json.hpp>
#include "core.h"

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);

	std::cout << core.ast.dump(1) << std::endl;
}