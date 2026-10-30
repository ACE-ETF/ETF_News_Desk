import type {Story} from './brief';
import {cryptoFlowTopic} from './overseas-events';
export type DisplayStory=Story & {topicLabel?:string;topicEvents?:Story[]};
// This presentation layer groups a topic, never equates different flow amounts.
// Keep every event group and all its source articles available inside the topic.
export function compressFlowTopics(stories:Story[]):DisplayStory[]{
 const buckets=new Map<string,Story[]>();
 for(const s of stories){const topic=cryptoFlowTopic(s.a);if(topic)buckets.set(topic,[...(buckets.get(topic)||[]),s])}
 const seen=new Set<string>(),out:DisplayStory[]=[];
 for(const s of stories){const topic=cryptoFlowTopic(s.a),events=topic?buckets.get(topic):undefined;if(!topic||!events||events.length<2){out.push(s);continue}if(seen.has(topic))continue;seen.add(topic);out.push({...s,topicLabel:topic,topicEvents:events})}
 return out;
}
