import { gql } from '@apollo/client'

export interface Package {
  id: number
  name: string
  fullName?: string
  description?: string
  totalDownloads?: number
  versionsCount?: number
  weeklyDownloads?: number
  license?: string
  createdAt?: string
  updatedAt?: string
  readmeText?: string
  homepageUrl?: string
  repositoryUrl?: string
  documentationUrl?: string
  repoFullName?: string
  keywords?: string[]
  platforms?: string[]
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
  } | null
  owner?: {
    githubLogin?: string
    displayName?: string
    avatarUrl?: string
  }
  versions?: {
    id: number
    version: string
    description?: string
    license?: string
    publishedAt?: string
    assetSizeBytes?: string
    installCount?: string
  }[]
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
      license
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
      description
      readmeText
      license
      homepageUrl
      repositoryUrl
      documentationUrl
      repoFullName
      totalDownloads
      versionsCount
      weeklyDownloads
      keywords
      platforms
      maintainers
      security
      createdAt
      updatedAt
      owner {
        githubLogin
        displayName
        avatarUrl
      }
      versions {
        id
        version
        description
        license
        publishedAt
        assetSizeBytes
        installCount
      }
    }
  }
`
