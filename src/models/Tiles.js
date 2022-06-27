import React from 'react'
import { useGLTF, Sparkles } from '@react-three/drei'

import { animated, useSpring } from '@react-spring/three';

export const Water = React.forwardRef((props, ref) => {
  const { nodes } = useGLTF('/models/water_rocks.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh receiveShadow geometry={nodes.water_rocks.geometry}>
        <meshStandardMaterial color={[0, 0.7, 1]}/>
        { props.children }
      </mesh>
    </group>
  )
});

export const WaterRocks = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/water_rocks.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh receiveShadow geometry={nodes.water_rocks.geometry}>
        <meshStandardMaterial color={[0, 0.7, 1]}/>
        <mesh castShadow receiveShadow geometry={nodes.rock.geometry} material={materials.stone} position={[0.1, 0.1, -0.35]} rotation={[0, Math.PI / 2, 0]} scale={[0.91, 0.43, 0.9]} />
        <mesh castShadow receiveShadow geometry={nodes.rock_1.geometry} material={materials.stone} position={[-0.05, 0.1, -0.41]} rotation={[0, Math.PI / 3, 0]} scale={[0.91, 0.87, 0.9]} />
        <mesh castShadow receiveShadow geometry={nodes.rock_2.geometry} material={materials.stone} position={[-0.34, 0.1, -0.19]} rotation={[0, Math.PI / 6, 0]} scale={[0.91, 0.43, 0.9]} />
        <mesh castShadow receiveShadow geometry={nodes.rock_3.geometry} material={materials.stone} position={[0.05, 0.1, 0.08]} rotation={[-Math.PI, 1.31, -Math.PI]} scale={[0.91, 0.43, 0.9]} />
        <mesh castShadow receiveShadow geometry={nodes.rock_4.geometry} material={materials.stone} position={[0.35, 0.1, 0.21]} rotation={[0, Math.PI / 6, 0]} scale={[0.91, 0.43, 0.9]} />
        <mesh castShadow receiveShadow geometry={nodes.rockLarge.geometry} material={materials.stone} position={[-0.36, 0.1, 0.19]} rotation={[Math.PI, -0.26, Math.PI]} scale={0.49} />
        <mesh castShadow receiveShadow geometry={nodes.rockLarge_1.geometry} material={materials.stone} position={[-0.02, 0.1, 0.3]} scale={0.73} />
        <mesh castShadow receiveShadow geometry={nodes.rockLarge_2.geometry} material={materials.stone} position={[-0.08, 0.1, -0.17]} scale={0.69} />
        <mesh castShadow receiveShadow geometry={nodes.rockLarge_3.geometry} material={materials.stone} position={[0.33, 0.1, -0.2]} rotation={[0, -Math.PI / 4, 0]} scale={0.52} />
        { props.children }
      </mesh>
    </group>
  )
});

export const Sea = React.forwardRef((props, ref) => {
  const { nodes } = useGLTF('/models/water.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh receiveShadow geometry={nodes.water.geometry}>
        <meshStandardMaterial color={[0, 123/255, 175/255]} opacity={0.7}/>
        { props.children }
      </mesh>
    </group>
  )
});

export const Grass = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/grass.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_grass.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_1.geometry} material={materials.grass}>
        { props.children }
      </mesh>
    </group>
  )
});

export const GrassForest = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/grass_forest.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      { props.children }
      <mesh geometry={nodes.Mesh_grass_forest.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_forest_1.geometry} material={materials.grass} />
      <group position={[0.32, 0.2, -0.08]} rotation={[0, -0.26, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.29, 0.2, 0.21]} rotation={[0, -Math.PI / 6, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.01, 0.2, 0.3]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.17, 0.2, -0.32]} rotation={[0, Math.PI / 6, 0]} scale={0.62}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.29, 0.2, -0.16]} rotation={[0, -0.66, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.3, 0.2, 0.19]} rotation={[0, -0.05, 0]} scale={0.62}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.04, 0.2, 0.01]} rotation={[0, 0.26, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.08, 0.2, -0.35]} rotation={[0, 0.15, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
    </group>
  )
});

export const DeepGrassForest = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/grass_forest.glb')
  return (
    <group ref={ref} {...props} dispose={null} rotation={[0, 1 * Math.PI / 3, 0]}>
      { props.children }
      <Sparkles count={5} speed={0.2} color="cyan" size={2} position={[0, 0.5, 0]} scale={[0.5, 0.05, 0.5]}/>
      <mesh geometry={nodes.Mesh_grass_forest.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_forest_1.geometry} material={materials.grass} />
      <group position={[0.32, 0.2, -0.08]} rotation={[0, -0.26, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.29, 0.2, 0.21]} rotation={[0, -Math.PI / 6, 0]} scale={0.97}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.01, 0.2, 0.3]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.17, 0.2, -0.32]} rotation={[0, Math.PI / 6, 0]} scale={0.72}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.29, 0.2, -0.16]} rotation={[0, -0.66, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.3, 0.2, 0.19]} rotation={[0, -0.05, 0]} scale={0.92}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.04, 0.2, 0.01]} rotation={[0, 0.26, 0]} scale={1.17}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.08, 0.2, -0.35]} rotation={[0, 0.15, 0]} scale={1.27}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
    </group>
  )
});

export const SelectTile = React.forwardRef(({ x, y, highlighted, ...props }, ref) => {
  const { nodes } = useGLTF('/models/grass.glb')
  const { opacity } = useSpring({ opacity: highlighted ? 0.3 : 0.1 });

  return (
    <group ref={ref} dispose={null} {...props}>
      <animated.mesh geometry={nodes.Mesh_grass_1.geometry} material-opacity={opacity}>
        <meshPhongMaterial transparent color="gray"/>
        { props.children }
      </animated.mesh>
    </group>
  )
});

useGLTF.preload('/models/grass_forest.glb')
useGLTF.preload('/models/grass.glb')
useGLTF.preload('/models/water_rocks.glb')
