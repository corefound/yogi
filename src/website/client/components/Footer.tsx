import Image from 'next/image';
import Link from 'next/link'
import logo from "../assets/logo.png"


export default function Footer() {
	return (
		<footer className="footer">
			<div className="container footer-grid">
				<div className="footer-copy ">
					<Link className="brand" href="/">
						<div className="footer-inner">
							<Image className="yogi-logo" quality={100} src={logo} alt="Yogi Registry" />
							<span style={{ fontFamily: "sans-serif" }}>Yogi</span>
						</div>
					</Link>
					<p>The modern package manager<br />for developers and teams.</p>
					<div className="socials"><span>⌘</span><span>𝕏</span><span>◈</span></div>
				</div>
				<div>
					<h4>Product</h4>
					<Link href="/">Explore</Link>
					<Link href="/docs">Documentation</Link>
				</div>
				<div>
					<h4>Resources</h4>
					<Link href="/docs">Documentation</Link>
					<a href="#">API Reference</a>
					<a href="#">Changelog</a>
					<a href="#">Status</a>
				</div>
				<div>
					<h4>Community</h4>
					<a href="#">GitHub</a>
					<a href="#">Discussions</a>
					<a href="#">Blog</a>
					<a href="#">Contributing</a>
				</div>
				<div>
					<p>© 2026 Yogi Registry. All rights reserved.</p>
					<p><a href="#">Terms</a> <a href="#">Privacy</a> <a href="#">Security</a> <a href="#">Cookies</a></p>
					<p>◎ English</p>
				</div>
			</div>
		</footer>
	)
}