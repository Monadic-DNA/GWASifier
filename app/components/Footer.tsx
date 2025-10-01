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
