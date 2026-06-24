'use client'

import { useState, useEffect, useRef } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import Link from 'next/link'
import { Dropdown, ConfigProvider, theme as antTheme } from 'antd'
import { SEARCH, type GetSearchData } from '@/lib/queries'
import { useTheme } from './ThemeProvider'
import { SiPkgsrc } from 'react-icons/si';
import { MdBusinessCenter } from 'react-icons/md';

interface SearchAutocompleteProps {
	variant: 'hero' | 'mini'
	placeholder?: string
}

export default function SearchAutocomplete({ variant, placeholder = 'Search packages...' }: SearchAutocompleteProps) {
	const { theme } = useTheme()
	const [query, setQuery] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const inputRef = useRef<HTMLInputElement>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [search, { data, loading }] = useLazyQuery<GetSearchData>(SEARCH, {
		fetchPolicy: 'cache-first',
	})

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)

		const trimmed = query.trim()
		if (trimmed.length < 2) {
			setIsOpen(false)
			return
		}

		debounceRef.current = setTimeout(() => {
			search({ variables: { query: trimmed, limit: 5 } })
			setIsOpen(true)
			setSelectedIndex(-1)
		}, 300)

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [query, search])

	const packages = data?.search?.packages ?? []
	const organizations = data?.search?.organizations ?? []
	const totalResults = packages.length + organizations.length
	const shouldShow = isOpen && (loading || totalResults > 0)

	function handleKeyDown(e: React.KeyboardEvent) {
		if (!shouldShow) return

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				setSelectedIndex(prev => (prev < totalResults - 1 ? prev + 1 : 0))
				break
			case 'ArrowUp':
				e.preventDefault()
				setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalResults - 1))
				break
			case 'Enter':
				e.preventDefault()
				if (selectedIndex >= 0) {
					if (selectedIndex < packages.length) {
						window.location.href = `/packages/${packages[selectedIndex].name}`
					} else {
						window.location.href = `/organizations/${organizations[selectedIndex - packages.length].name}`
					}
				}
				break
			case 'Escape':
				setIsOpen(false)
				inputRef.current?.blur()
				break
		}
	}

	const dropdownContent = (
		<div className="search-dropdown">
			{loading && (
				<div className="search-dropdown-loading">Searching...</div>
			)}

			{!loading && packages.length > 0 && (
				<>
					<div className="search-dropdown-header">Packages</div>
					{packages.map((pkg, idx) => (
						<Link
							key={pkg.id}
							href={`/packages/${pkg.name}`}
							className={`search-dropdown-item ${selectedIndex === idx ? 'selected' : ''}`}
							onMouseEnter={() => setSelectedIndex(idx)}
							onClick={() => setIsOpen(false)}
						>
							<span className="search-dropdown-item-icon"><SiPkgsrc /></span>
							<div className="search-dropdown-item-content">
								<span className="search-dropdown-item-name">{pkg.name}</span>
							</div>
						</Link>
					))}
				</>
			)}

			{!loading && organizations.length > 0 && (
				<>
					<div className="search-dropdown-header">Organizations</div>
					{organizations.map((org, idx) => {
						const actualIdx = packages.length + idx
						return (
							<Link
								key={org.id}
								href={`/organizations/${org.name}`}
								className={`search-dropdown-item ${selectedIndex === actualIdx ? 'selected' : ''}`}
								onMouseEnter={() => setSelectedIndex(actualIdx)}
								onClick={() => setIsOpen(false)}
							>
								<span className="search-dropdown-item-icon"><MdBusinessCenter /></span>
								<div className="search-dropdown-item-content">
									<span className="search-dropdown-item-name">{org.displayName || org.name}</span>
									{org.description && (
										<span className="search-dropdown-item-desc">{org.description}</span>
									)}
								</div>
							</Link>
						)
					})}
				</>
			)}
		</div>
	)

	return (
		<ConfigProvider
			theme={{
				algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
				token: {
					colorBgElevated: theme === 'dark' ? 'rgba(18, 20, 28, 0.98)' : '#ffffff',
					borderRadiusLG: 12,
					boxShadowSecondary: theme === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
				},
			}}
		>
			<Dropdown
				open={shouldShow}
				arrow
				onOpenChange={(open) => { if (!open) setIsOpen(false) }}
				dropdownRender={() => dropdownContent}
				placement="bottom"
			>
				<label className={variant === 'hero' ? 'search-hero' : 'search-mini'}>
					<span style={{ fontSize: 26 }}>⌕</span>
					<input
						ref={inputRef}
						placeholder={placeholder}
						value={query}
						onChange={e => setQuery(e.target.value)}
						onFocus={() => { if (query.trim().length >= 2) setIsOpen(true) }}
						onKeyDown={handleKeyDown}
					/>
				</label>
			</Dropdown>
		</ConfigProvider>
	)
}
