import math
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import imageio
from scipy.optimize import linear_sum_assignment


"""
Some helper functions - should be self-explanatory
"""
def dist(p1,p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def jitter(values):
    return values + np.random.normal(0, 0.03,[len(values), 2])

def getXY(points):
    return [p[0] for p in points], [p[1] for p in points]

def interpolatePoints(points1, points2, percent_to_point2, col_ind):
    return [
        (p1[0] + (points2[col_ind[index_p1]][0]-p1[0])*percent_to_point2,
         p1[1] + (points2[col_ind[index_p1]][1]-p1[1])*percent_to_point2)
        for index_p1, p1 in enumerate(points1)
    ]

def main():
    # Initialize the points
    points1 = [(0,0) for _ in range(4)] + [(0,1) for _ in range(1)] + [(1,0) for _ in range(2)] + [(2,0) for _ in range(1)]

    points2 = [(2,2) for _ in range(4)] + [(1,0) for _ in range(1)] + [(2,1) for _ in range(2)] + [(2,0) for _ in range(1)]

    x1,y1 = getXY(jitter(points1))
    x2,y2 = getXY(jitter(points2))
    colors = sns.color_palette('hls', 8)

    # sns.scatterplot(x=x1, y=y1, color='red', s=100)
    # plt.title('Before')
    # plt.show()
    # sns.scatterplot(x=x2, y=y2, color='blue', s=100)
    # plt.title('After')
    # plt.show()

    # Calculate the distance matrix => Should be actual distance between long lat points which won't be Euclidean
    mat = np.zeros((len(points1), len(points1)))
    for i in range(len(points1)):
        for j in range(len(points1)):
            mat[i][j] = dist(points1[i], points2[j])

    # Run the optimization
    row_ind, col_ind = linear_sum_assignment(mat)

    num_frames = 10

    # make a GIF
    frames = []
    duration = 0.5

    for i in range(num_frames):
        plt.figure(figsize=(6,4))
        new_x, new_y = getXY(interpolatePoints(points1, points2, i/(num_frames - 1), col_ind))
        sns.scatterplot(x=new_x, y=new_y, s=100, hue=colors, legend=False)
        plt.xlim(-0.1, 2.1)
        plt.ylim(-0.1, 2.1)

        # Save the plot as an image temporarily
        filename = f"plot_{i}.png"
        plt.savefig(filename)
        frames.append(imageio.imread(filename))

        plt.close()

    imageio.mimsave('flow.gif', frames, format='GIF', duration=duration)

if __name__ == '__main__':
    main()


