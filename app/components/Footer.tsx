export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <p className="copyright">
            © {new Date().getFullYear()}{" "}
            <a
              href="https://recherche.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Recherche Inc
            </a>
            . All rights reserved.
          </p>
        </div>

        <div className="footer-section social-links">
          <p>Follow Monadic DNA:</p>
          <div className="social-icons">
            <a
              href="https://x.com/MonadicDNA"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="X (Twitter)"
              title="Follow us on X"
            >
              𝕏
            </a>
            <a
              href="https://farcaster.xyz/monadicdna"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="Farcaster"
              title="Follow us on Farcaster"
            >
              🟪
            </a>
            <a
              href="https://recherche.discourse.group/c/public/monadic-dna/30"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="Community Forum"
              title="Join our community forum"
            >
              💬
            </a>
          </div>
        </div>

        <div className="footer-section">
          <p className="data-credit">
            Data sourced from the{" "}
            <a
              href="https://www.ebi.ac.uk/gwas/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              GWAS Catalog
            </a>
            . Dataset: "All associations v1.0.2 - with added ontology annotations, GWAS Catalog study accession numbers and genotyping technology".
          </p>
        </div>
      </div>
    </footer>
  );
}
