# CS 436 Project
## Folder Structure
```
project_root/
├── Initial_viewer/ (Independent Point Clouds)
├── final_viewer/ (Final Virtual Tour)
├── data/ (Overall Data)
├── new_bed_corner/ (Final Data to Generate Point Cloud of Bed corner)
├── new_bookshelf_corner/ (Final Data to Generate Point Cloud of Bookshelf corner)
├── superglue_pretrained/
├── __pycache__/
├── bundle_adjustment.py
├── feature_matching_glue.py (Feature Matching Using SuperGlue)
├── Week1.ipynb
├── Week2.ipynb
├── Week_4.ipynb
├── week3_superglue.ipynb
├── point_cloud_room_reality_capture.ply (Point Cloud of the Whole Room Using Reality Capture)
├── .gitignore
└── README.md
```
## Accessing the Virtual Tour

To run the interactive virtual tour locally, follow these steps:

```bash
cd final_viewer
npm install
npm run dev
