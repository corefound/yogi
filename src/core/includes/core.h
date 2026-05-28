//
// Created by Brayhan De Aza on 5/28/26.
//

#pragma once
#include "json.hpp"

namespace yogi::core {
    class Core final {
        public:
            static nlohmann::json TSParser();
    };

}