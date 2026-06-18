#pragma once

#include <string>
#include <map>
#include <vector>
#include "../lockfile/types.hpp"
#include "packageIdentity.hpp"

namespace yogi::packages {

struct GraphNode {
  PackageIdentity identity;
  std::vector<PackageIdentity> dependencies;
  std::vector<PackageIdentity> devDependencies;
};

struct PackageGraph {
  std::map<std::string, GraphNode> nodes;
  GraphNode root;
};

PackageGraph buildPackageGraph(
  const yogi::lockfile::Lockfile& lockfile,
  const std::string& rootName,
  const std::map<std::string, std::string>& rootDependencies = {},
  const std::map<std::string, std::string>& rootDevDependencies = {});

} // namespace yogi::packages
