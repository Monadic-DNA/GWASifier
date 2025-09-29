# GWASifier

Match your DNA data against an open ended catalogue of DNA traits

## Development

### Preparing local data

Fetch the latest GWAS Catalog data from https://www.ebi.ac.uk/gwas/api/search/downloads/alternative into the `localdata` directory. This is "All associations v1.0.2 - with added ontology annotations, GWAS Catalog study accession numbers and genotyping technology" from https://www.ebi.ac.uk/gwas/docs/file-downloads. 

Create a new SQLite database at `localdata/gwas_catalog.sqlite`.

Load the contents of the TSV file into the SQLite database using your favorite method.

## Citations

Cerezo M, Sollis E, Ji Y, Lewis E, Abid A, Bircan KO, Hall P, Hayhurst J, John S, Mosaku A, Ramachandran S, Foreman A, Ibrahim A, McLaughlin J, Pendlington Z, Stefancsik R, Lambert SA, McMahon A, Morales J, Keane T, Inouye M, Parkinson H, Harris LW.
doi.org/10.1093/nar/gkae1070
Nucleic Acids Research, Volume 53, Issue D1, 6 January 2025, Pages D998–D1005
