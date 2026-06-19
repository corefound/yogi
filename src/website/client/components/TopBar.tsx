'use client'

import Link from 'next/link'
import Image from 'next/image'
import logo from "../assets/logo.png"
import { usePathname } from 'next/navigation'

export default function TopBar() {
	const pathname = usePathname()
	const isActive = (path: string) => pathname === path

	return (
		<header className="topbar">
			<div className="container nav-inner">
				<Link className="brand" href="/">
					<Image className="yogi-logo" quality={100} src={logo} alt="Yogi Registry" />
					<span style={{fontFamily: "sans-serif"}}>Yogi</span>
				</Link>
				<nav className="nav-links" aria-label="Main navigation">
					<Link className={isActive('/') ? 'active' : ''} href="/">Explore</Link>
					<Link className={isActive('/docs') ? 'active' : ''} href="/docs">Documentation</Link>
				</nav>
				<div className="nav-actions">
					<button className="icon-btn" aria-label="Toggle theme">☾</button>
					<span className="avatar" aria-label="User profile"></span>
				</div>
			</div>
		</header>
	)
}