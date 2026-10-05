import cv2, numpy as np, json
from scipy import ndimage as ndi
J=json.load(open('timeline.json')); W,H=J['W'],J['H']
im=cv2.imread('scroll.jpg'); V=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)[...,2].astype(int)
r=im[...,2].astype(int); g=im[...,1].astype(int); red=(r-g>38)&(r>85)
bg=cv2.medianBlur(cv2.resize(V.astype(np.uint8),(W//4,H//4)),61); bg=cv2.resize(bg,(W,H)).astype(int)
cols=np.load('cols.npy')
dark=((V<bg-22)|(V<118))&~red; dark[:, :cols[0]-30]=False; dark[:, cols[-1]+30:]=False
mask=ndi.binary_dilation(dark,iterations=4)&~ndi.binary_dilation(red,iterations=1)
small=cv2.resize(im,(W//2,H//2)); ms=(cv2.resize(mask.astype(np.uint8)*255,(W//2,H//2))>0).astype(np.uint8)*255
bl=cv2.inpaint(small,ms,15,cv2.INPAINT_TELEA); bl=cv2.resize(bl,(W,H),interpolation=cv2.INTER_CUBIC).astype(np.float32)
tex=im.astype(np.float32)-cv2.GaussianBlur(im.astype(np.float32),(0,0),6)
sh=np.roll(np.roll(tex,37,0),53,1); keep=~ndi.binary_dilation(np.roll(np.roll(mask,37,0),53,1),iterations=2)
bl=bl+np.where(keep[...,None],sh,0)*0.9
out=np.where(mask[...,None],np.clip(bl,0,255),im).astype(np.uint8)
cv2.imwrite('blank.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,95]); cv2.imwrite('film/blank.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,95])
