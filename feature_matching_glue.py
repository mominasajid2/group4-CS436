import cv2
import numpy as np
import torch
from models.matching import Matching
from models.utils import frame2tensor


config = {
    'superpoint': {
        'nms_radius': 4,
        'keypoint_threshold': 0.005,
        'max_keypoints': 1024
    },
    'superglue': {
        'weights': 'outdoor',
        'sinkhorn_iterations': 20,
        'match_threshold': 0.2,
    }
}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
matching = Matching(config).eval().to(device)


_last_gray = {}
_last_kp = {}
_last_desc = {}

def detect_and_compute(gray):
    global _last_gray, _last_kp, _last_desc

    inp = frame2tensor(gray, device)

    with torch.no_grad():
        pred = matching.superpoint({'image': inp})

    kpts = pred['keypoints'][0].cpu().numpy()
    desc = pred['descriptors'][0].cpu().numpy().T   

    kp_cv = [cv2.KeyPoint(float(x), float(y), 1) for (x, y) in kpts]

    _id = id(gray)
    _last_gray[_id] = gray
    _last_kp[_id] = kp_cv
    _last_desc[_id] = desc

    return kp_cv, desc, cv2.NORM_L2


def match_features(des1, des2, norm_type, ratio=0.75):
    global _last_gray, _last_kp, _last_desc

    if (any(v is des1 for v in _last_desc.values()) and
        any(v is des2 for v in _last_desc.values())):

        id1 = next(k for k,v in _last_desc.items() if v is des1)
        id2 = next(k for k,v in _last_desc.items() if v is des2)

        gray1 = _last_gray[id1]
        gray2 = _last_gray[id2]

        inp0 = frame2tensor(gray1, device)
        inp1 = frame2tensor(gray2, device)

        batch = {'image0': inp0, 'image1': inp1}

        with torch.no_grad():
            pred = matching(batch)

        matches0 = pred['matches0'][0].cpu().numpy()

        good = []
        for i0, i1 in enumerate(matches0):
            if i1 == -1:
                continue
            good.append(cv2.DMatch(_queryIdx=i0, _trainIdx=int(i1), _distance=0.0))

        return good

    bf = cv2.BFMatcher(norm_type)
    raw = bf.knnMatch(des1, des2, k=2)

    good = [m for m,n in raw if m.distance < ratio * n.distance]
    return good


def load_image(path):
    color = cv2.imread(path)
    gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
    return color, gray

# def detect_and_compute(gray):
#     detector = cv2.SIFT_create()    
#     norm = cv2.NORM_L2
#     k, d = detector.detectAndCompute(gray, None)
#     return k, d, norm

# def match_features(des1, des2, norm_type, ratio=0.75):
#     bf = cv2.BFMatcher(norm_type)
#     raw_matches = bf.knnMatch(des1, des2, k=2)
#     valid_matches = [m for m, n in raw_matches if m.distance < ratio * n.distance]
#     return valid_matches

def draw_feature_matches(img1, kp1, img2, kp2, matches, max_draw):
    draw = cv2.drawMatches(img1, kp1, img2, kp2, matches[:max_draw], None, flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    return draw

def match_pairs(image_paths, num=4):
    img_pairs_to_match = [(image_paths[i], image_paths[i+1]) for i in range(num)]
    match_results = []
    matched_pts_list = []
    for path1, path2 in img_pairs_to_match:
        img1_color, img1_gray = load_image(path1)
        img2_color, img2_gray = load_image(path2)
        k1, d1, norm = detect_and_compute(img1_gray)
        k2, d2, _ = detect_and_compute(img2_gray)
        matches = match_features(d1, d2, norm, ratio=0.75)
        matched_vis = draw_feature_matches(img1_color, k1, img2_color, k2, matches, max_draw=60)
        match_results.append(matched_vis)
        pts1 = np.float32([k1[m.queryIdx].pt for m in matches])
        pts2 = np.float32([k2[m.trainIdx].pt for m in matches])
        matched_pts_list.append((pts1, pts2))

    return match_results, matched_pts_list