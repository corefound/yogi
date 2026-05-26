#include <iostream>
#include <memory>
#include <stdexcept>
#include <array>

std::string exec(const std::string& cmd) {
    std::array<char, 128> buffer{};
    std::string result;

    std::unique_ptr<FILE, decltype(&pclose)> pipe(
        popen(cmd.c_str(), "r"),
        pclose
    );

    if(!pipe) {
        throw std::runtime_error("popen failed");
    }

    while(fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
        result += buffer.data();
    }

    return result;
}

int main() {
    std::string input =
        std::string(TS_PARSER) + " " +
        std::string(TS_TESTS) + "/main.io";
    std::string output = exec(input);

    std::cout << "RAW OUTPUT:\n" << input << std::endl;
}