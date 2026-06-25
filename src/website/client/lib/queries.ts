import { gql } from '@apollo/client'

export interface Package {
  id: number
  name: string
  fullName?: string
  scope?: string
  description?: string
  totalDownloads?: number
  versionsCount?: number
  latestVersion?: string
  weeklyDownloads?: number
  license?: string
  logo?: string
  createdAt?: string
  updatedAt?: string
  readmeText?: string
  homepageUrl?: string
  repositoryUrl?: string
  documentationUrl?: string
  repoFullName?: string
  keywords?: string[]
  maintainers?: {
    userId: number
    login: string
    role: string
  }[]
  security?: {
    status: string
    vulnerabilitiesCount: number
    malwareScanStatus: string
    lastScannedAt: string
    vulnerabilities: Array<{
      id: string
      severity: string
      type: string
      title: string
      description: string
      packageName: string
      versionRange: string
      fixedIn: string | null
      reportedAt: string
      status: string
    }>
  } | null
  owner?: {
    githubLogin?: string
    displayName?: string
    avatarUrl?: string
  }
  downloadTrend?: { date: string; downloads: number }[]
  versions?: Version[]
}

export interface Version {
  id: number
  packageId?: number
  version: string
  description?: string
  readmeText?: string
  license?: string
  publishedAt?: string
  assetSizeBytes?: string
  minifiedSizeBytes?: string
  installCount?: string
  checksum?: string
  tarballUrl?: string
  status?: string
  publishedByUserId?: number
  platforms?: string[]
  dependencies?: { dependencyName: string; versionRange: string; dependencyType?: string }[]
  assets?: { target: string; artifactType: string; fileName: string; url: string; sizeBytes: number }[]
}

export interface GetVersionData {
  version: Version
}

export interface GetPackagesData {
  packages: Package[]
}

export interface GetPackageData {
  package: Package
}

export const GET_PACKAGES = gql`
  query GetPackages($limit: Int, $offset: Int) {
    packages(limit: $limit, offset: $offset) {
      id
      name
      description
      totalDownloads
      versionsCount
      license
      logo
      createdAt
      owner {
        githubLogin
        displayName
      }
    }
  }
`

export interface Metric {
  key: string
  value: number
  label?: string
}

export interface GetMetricsData {
  metrics: Metric[]
}

export interface Organization {
  id: number
  name: string
  displayName?: string
  description?: string
  packages?: Package[]
}

export interface GetOrganizationsData {
  organizations: Organization[]
}

export interface GetPopularOrganizationsData {
  popularOrganizations: Organization[]
}

export interface User {
  id: number
  githubLogin: string
  displayName?: string
  avatarUrl?: string
  role: string
}

export interface ProfilePackage {
  id: number
  name: string
  fullName: string
  description?: string
  totalDownloads: number
  weeklyDownloads: number
  versionsCount: number
  latestVersion: string
  license?: string
  logo?: string
}

export interface ProfileUser extends User {
  packages: ProfilePackage[]
}

export interface GetUserData {
  user: ProfileUser
}

export const GET_USER = gql`
  query GetUser($name: String!) {
    user(name: $name) {
      id
      githubLogin
      displayName
      avatarUrl
      email
      role
      packages {
        id
        name
        fullName
        description
        totalDownloads
        weeklyDownloads
        versionsCount
        latestVersion
        license
        logo
      }
    }
  }
`

export interface GetUsersData {
  users: User[]
}

export interface GetMaintainersData {
  gayMaintainers: User[]
}

export const GET_MAINTAINERS = gql`
  query GetMaintainers {
    gayMaintainers {
      id
      githubLogin
      displayName
      avatarUrl
      role
    }
  }
`

export const GET_USERS = gql`
  query GetUsers($limit: Int, $role: String) {
    users(limit: $limit, role: $role) {
      id
      githubLogin
      displayName
      avatarUrl
      role
    }
  }
`

export interface SearchResult {
  packages: Package[]
  organizations: Organization[]
}

export interface GetSearchData {
  search: SearchResult
}

export const SEARCH = gql`
  query Search($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      packages {
        id
        name
        description
        owner {
          githubLogin
          displayName
        }
      }
      organizations {
        id
        name
        displayName
        description
      }
    }
  }
`

export interface GetOrganizationDetailData {
  organization: Organization
}

export interface Category {
  name: string
  slug: string
  packageCount: number
}

export interface GetCategoriesData {
  categories: Category[]
}

export interface GetCategoriesListData {
  categoriesList: {
    categories: Category[]
    remainingPackageCount: number
  }
}

export interface GetTrendingPackagesData {
  trendingPackages: Package[]
}

export const GET_METRICS = gql`
  query GetMetrics {
    metrics {
      key
      value
      label
    }
  }
`

export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      name
      slug
      packageCount
    }
  }
`

export const GET_CATEGORIES_LIST = gql`
  query GetCategoriesList($limit: Int) {
    categoriesList(limit: $limit) {
      categories {
        name
        slug
        packageCount
      }
      remainingPackageCount
    }
  }
`

export interface GetCategoryData {
  category: Category
}

export interface GetPackagesByCategoryData {
  packagesByCategory: Package[]
  category?: Category
}

export const GET_CATEGORY = gql`
  query GetCategory($slug: String!) {
    category(slug: $slug) {
      name
      slug
      packageCount
    }
  }
`

export const GET_PACKAGES_BY_CATEGORY = gql`
  query GetPackagesByCategory($slug: String!) {
    packagesByCategory(slug: $slug) {
      id
      name
      fullName
      description
      totalDownloads
      weeklyDownloads
      versionsCount
      license
      logo
      keywords
      owner {
        githubLogin
        displayName
      }
    }
  }
`

export const GET_TRENDING_PACKAGES = gql`
  query GetTrendingPackages($limit: Int) {
    trendingPackages(limit: $limit) {
      id
      name
      fullName
      description
      totalDownloads
      weeklyDownloads
      versionsCount
      latestVersion
      license
      logo
      owner {
        githubLogin
        displayName
      }
    }
  }
`

export const GET_ORGANIZATIONS = gql`
  query GetOrganizations {
    organizations {
      id
      name
      displayName
      description
      packages {
        fullName
        totalDownloads
      }
    }
  }
`

export const GET_POPULAR_ORGANIZATIONS = gql`
  query GetPopularOrganizations($limit: Int) {
    popularOrganizations(limit: $limit) {
      id
      name
      displayName
      description
      packages {
        fullName
        totalDownloads
        weeklyDownloads
      }
    }
  }
`

export const GET_ORGANIZATION_DETAIL = gql`
  query GetOrganizationDetail($name: String!) {
    organization(name: $name) {
      id
      name
      displayName
      description
      packages {
        id
        name
        fullName
        description
        totalDownloads
        weeklyDownloads
        versionsCount
      }
    }
  }
`

export const GET_PACKAGE = gql`
  query GetPackage($name: String!) {
    package(name: $name) {
      id
      name
      scope
      description
      readmeText
      license
      logo
      homepageUrl
      repositoryUrl
      documentationUrl
      repoFullName
      totalDownloads
      versionsCount
      latestVersion
      weeklyDownloads
      keywords
      maintainers
      security
      createdAt
      updatedAt
      owner {
        githubLogin
        displayName
        avatarUrl
      }
      downloadTrend
      versions {
        id
        version
        description
        license
        publishedAt
        assetSizeBytes
        installCount
        platforms
      }
    }
  }
`

export const GET_VERSION = gql`
  query GetVersion($packageName: String!, $version: String!) {
    version(packageName: $packageName, version: $version) {
      id
      packageId
      version
      description
      readmeText
      license
      assetSizeBytes
      minifiedSizeBytes
      installCount
      checksum
      tarballUrl
      status
      platforms
      publishedAt
      publishedByUserId
      dependencies
      assets
    }
  }
`

export interface VersionProfile {
  packageId: number
  fullName: string
  scope?: string
  name: string
  displayName?: string
  description?: string
  license?: string
  logo?: string
  status?: string
  verificationStatus?: string
  repositoryUrl?: string
  homepageUrl?: string
  documentationUrl?: string
  totalDownloads: number
  weeklyDownloads: number
  versionsCount: number
  dependenciesCount: number
  dependentsCount: number
  keywords?: string[]
  maintainers?: {
    userId: number
    username: string
    avatarUrl: string | null
    role: string
  }[]
  owner?: {
    githubLogin?: string
    displayName?: string
    avatarUrl?: string
  }
  versionId: number
  version: string
  versionDescription?: string
  versionReadmeText?: string
  assetSizeBytes?: string
  minifiedSizeBytes?: string
  installCount?: string
  checksum?: string
  tarballUrl?: string
  platforms?: string[]
  dependencies?: { dependencyName: string; versionRange: string; dependencyType?: string }[]
  assets?: { target: string; artifactType: string; fileName: string; url: string; sizeBytes: number }[]
  publishedAt?: string
  publishedByUserId?: number
  isLatestVersion: boolean
  installCommand: string
  security?: {
    status: string
    vulnerabilitiesCount: number
    malwareScanStatus: string
    lastScannedAt: string
    vulnerabilities: Array<{
      id: string
      severity: string
      type: string
      title: string
      description: string
      packageName: string
      versionRange: string
      fixedIn: string | null
      reportedAt: string
      status: string
    }>
  } | null
  downloadTrend?: { date: string; downloads: number }[]
  versions?: {
    id: number
    version: string
    description?: string
    assetSizeBytes?: string
    installCount?: string
    platforms?: string[]
    publishedAt?: string
  }[]
}

export interface GetVersionProfileData {
  versionProfile: VersionProfile
}

export const GET_VERSION_PROFILE = gql`
  query GetVersionProfile($name: String!, $version: String!) {
    versionProfile(name: $name, version: $version) {
      packageId
      fullName
      name
      description
      license
      logo
      status
      repositoryUrl
      homepageUrl
      documentationUrl
      totalDownloads
      weeklyDownloads
      versionsCount
      keywords
      maintainers
      owner {
        githubLogin
        displayName
        avatarUrl
      }
      versionId
      version
      versionDescription
      versionReadmeText
      assetSizeBytes
      minifiedSizeBytes
      installCount
      checksum
      tarballUrl
      platforms
      dependencies
      assets
      publishedAt
      isLatestVersion
      installCommand
      security
      downloadTrend
      versions {
        id
        version
        description
        assetSizeBytes
        installCount
        platforms
        publishedAt
      }
    }
  }
`
