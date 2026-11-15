WAC Time-Weighted South Pole Illumination Map

The Lunar Reconnaissance Orbiter Camera (LROC) provides multi-temporal images of the polar regions, with repeat imaging with the Wide-Angle Camera approximately every 2 hours with a ground sampling distance of 100 meters enabling production of an illumination map from 88 to 90 degrees south. To create the polar illumination map, WAC images acquired over one lunar year from 15 February 2010 to 5 February 2011 were used, resulting in 3807 observations. Temporal gaps were filled with 229 observations acquired with virtually identical lighting at other times during the mission. Each image was first map-projected at 100 meters/pixel in polar stereographic projection onto a 30 m DEM provided by the LOLA team (Smith et al., 2010) using an improved WAC distortion model (Speyerer et al., 2016) and improved spacecraft ephemeris (Mazarico et al., 2011). Binary images indicating the illumination state of each image were created by applying a series of spatial filters and a conservative global threshold. Like the percentage-based illumination maps, this illumination map was derived by taking the number of times a mapped pixel was illuminated over the number of instances the mapped pixel was imaged. However, in order to minimize biases introduced by non-equally spaced observations, images taken during periods of infrequent WAC observations are weighted twice as much as those taken during nominal operations and areas not within the field of view were linearly interpolated based on preceding and subsequent observations where image data was available for a specific mapped pixel. A version of the illumination map without interpolation is archived under WAC_POLE_ILL_PCT_NORTH and WAC_POLE_ILL_PCT_SOUTH. For more information on the derivation of these products and for a map of image counts per pixel, see Speyerer and Robinson (2013). Due to a small amount of image noise and scattered light, some regions that are permanently shadowed from direct solar illumination have percentage values that are close to, but not equal to zero. These artifacts in the middle of permanently shadowed regions should be ignored when analyzing the extent.

Low-resolution 8-bit browse products in PNG format for this product, along with full-resolution 8-bit GeoTIFFs, are available at the following location, with names matching those of the full-resolution IMG files: http://lroc.sese.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_POLE/WAC_POLE_ILL_TWI_SOUTH/

When citing this product, use the following reference: Speyerer, E. J., & Robinson, M. S. (2013). Persistently illuminated regions at the lunar poles: Ideal sites for future exploration. Icarus, 222(1), 122-136. https://doi.org/10.1016/j.icarus.2012.10.010


Product Name		WAC_POLE_ILL_TWI_SOUTH_100M
Illumination Map	Time-Weighted
Pole			South (88S to 90S)
Resolution		100 meters/pixel


References:

Mazarico, E., Rowlands, D. D., Neumann, G. A., Smith, D. E., Torrence, M. H., Lemoine, F. G., and Zuber, M. T. (2012). Orbit determination of the Lunar Reconnaissance Orbiter. Journal of Geodesy, 86(3), 193-207. doi:10.1007/s00190-011-0509-4

Smith, D. E., Zuber, M. T., Neumann, G. A., Lemoine, F. G., Mazarico, E., Torrence, M. H., McGarry, J. F., Rowlands, D. D, Head III, J. W., Duxbury, T. H., Aharonson, O., Lucey, P. G., Robinson, M. S., Barnouin, O. S., Cavanaugh, J. F., Sun, X., Liiva, P., Mao, D., Smith, J. C., and Bartels A. E. (2010). Initial observations from the Lunar Orbiter Laser Altimeter (LOLA). Geophysical Research Letters, 37(18). doi:10.1029/2010GL043751

Speyerer, E. J., Wagner, R. V., Robinson, M. S., Licht, A., Thomas, P. C., Becker, K., Anderson, J., Brylow, S. M., Humm, D. C., and Tschimmel, M. (2014). Pre-flight and on-orbit geometric calibration of the Lunar Reconnaissance Orbiter Camera, Space Science Reviews, 200, 357–392. doi:10.1007/s11214-014-0073-3

Speyerer, E. J. and Robinson, M. S. (2013). Persistently illuminated regions at the lunar poles: Ideal sites for future exploration. Icarus, 222(1), 122-136. doi:10.1016/j.icarus.2012.10.010


For more information on LROC Reduced Data Records (RDRs), please refer to the LROC RDR Software Interface Specification (SIS).
