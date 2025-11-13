import cv2
import numpy as np

def load_image(path):
    color = cv2.imread(path)
    gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
    return color, gray

def detect_and_compute(gray):
    detector = cv2.SIFT_create()    
    norm = cv2.NORM_L2
    k, d = detector.detectAndCompute(gray, None)
    return k, d, norm

def match_features(des1, des2, norm_type, ratio=0.75):
    bf = cv2.BFMatcher(norm_type)
    raw_matches = bf.knnMatch(des1, des2, k=2)
    valid_matches = [m for m, n in raw_matches if m.distance < ratio * n.distance]
    return valid_matches

def draw_feature_matches(img1, kp1, img2, kp2, matches, max_draw):
    draw = cv2.drawMatches(img1, kp1, img2, kp2, matches[:max_draw], None, flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    return draw

def match_pairs(image_paths):
    img_pairs_to_match = [(image_paths[i], image_paths[i+1]) for i in range(4)]
    match_results = []
    for path1, path2 in img_pairs_to_match:
        img1_color, img1_gray = load_image(path1)
        img2_color, img2_gray = load_image(path2)
        k1, d1, norm = detect_and_compute(img1_gray)
        k2, d2, _ = detect_and_compute(img2_gray)
        matches = match_features(d1, d2, norm, ratio=0.75)
        matched_vis = draw_feature_matches(img1_color, k1, img2_color, k2, matches, max_draw=60)
        match_results.append(matched_vis)
    return match_results