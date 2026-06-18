#include "packages/packageGraph.hpp"

namespace yogi::packages {

PackageGraph buildPackageGraph(
  const yogi::lockfile::Lockfile& lockfile,
  const std::string& rootName,
  const std::map<std::string, std::string>& rootDependencies,
  const std::map<std::string, std::string>& rootDevDependencies) {

  PackageGraph graph;
  PackageIdentity rootId{rootName, "0.0.0"};

  std::vector<PackageIdentity> rootDeps;
  for (const auto& [name, version] : rootDependencies)
    rootDeps.push_back({name, version});

  std::vector<PackageIdentity> rootDevDeps;
  for (const auto& [name, version] : rootDevDependencies)
    rootDevDeps.push_back({name, version});

  graph.root = {rootId, rootDeps, rootDevDeps};
  graph.nodes[identityKey(rootId)] = graph.root;

  for (const auto& [key, entry] : lockfile.packages) {
    auto parsed = identityFromKey(key);
    if (!parsed) continue;

    std::vector<PackageIdentity> deps;
    if (entry.dependencies) {
      for (const auto& [name, version] : *entry.dependencies)
        deps.push_back({name, version});
    }

    std::vector<PackageIdentity> devDeps;
    if (entry.devDependencies) {
      for (const auto& [name, version] : *entry.devDependencies)
        devDeps.push_back({name, version});
    }

    graph.nodes[key] = {*parsed, deps, devDeps};
  }

  return graph;
}

} // namespace yogi::packages
