# Receipt edges are found on the phone, not on the Tally computer

A receipt photo is cropped to the receipt's edges and straightened (the Cropped Photo) so Reviewers see the receipt, not the table it lay on. The edges are found on the phone, right after the photo is taken, and the employee confirms or drags the corners before sending. The backend only receives the four corners and applies them with Pillow. We chose this because the person holding the receipt is the one who can tell whether the outline is right, and because it keeps OpenCV and numpy (tens of MB) out of the bundled backend on both macOS and Windows. The cost is a ~10 MB OpenCV.js file that the capture page downloads from the Tally computer, which the browser then caches.

## Considered Options

- **Detect on the computer after upload.** This needs no extra step on the phone, but it bundles OpenCV into the sidecar for both platforms, and a wrong outline would only be found later by the Reviewer.
- **A live outline over the camera view.** This needs `getUserMedia`, which browsers allow only on secure pages. The capture page is plain HTTP on the office LAN, so this would first require local HTTPS.

## Consequences

- The Receipt Photo is never altered. The Cropped Photo is stored next to it, along with the corners, so a crop can be redone without a new photo, and the duplicate check still hashes the Receipt Photo.
- Corners are fractions of the *upright* photo (EXIF orientation applied), which is how phone browsers show it. The backend applies EXIF orientation before cropping and before OCR.
- Detection is a nicety and never blocks sending. If the detector hasn't loaded, can't read the file (HEIC outside Safari), or finds no clear paper outline, the whole photo is sent.
- Detection looks for bright, low-colour paper, not edges: edges alone picked out hands and patterned tables on our sample photos. When the paper seems to fill the photo both ways (a white table), it declines rather than guess, because a crop that is too tight loses line items.
