"use client";

import UserDataUpload, { useGenotype } from "./UserDataUpload";

export default function MenuBar() {
  const { isUploaded, genotypeData } = useGenotype();

  return (
    <div className="menu-bar">
      <div className="menu-left">
        <h1 className="app-title">GWASifier</h1>
        <span className="app-subtitle">GWAS Catalog Explorer</span>
      </div>
      
      <div className="menu-right">
        <div className="status-section">
          {isUploaded && genotypeData && (
            <div className="genotype-stats">
              <span className="stat-item">
                {genotypeData.size.toLocaleString()} variants loaded
              </span>
            </div>
          )}
          <UserDataUpload />
        </div>
      </div>
    </div>
  );
}
